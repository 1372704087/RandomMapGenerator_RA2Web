// 0x58e9b0 Region_Bfs2 size=207

char __thiscall sub_58E9B0(_DWORD *this)
{
  int v1; // esi
  int v2; // ecx
  int v3; // ebx
  int v4; // eax
  _DWORD *v5; // edi
  int v6; // eax
  int v7; // ecx
  int i; // eax
  int v9; // eax
  int v10; // ebx
  int k; // esi
  int v12; // eax
  int v13; // ecx
  char *v14; // eax
  int v15; // eax
  int v17; // [esp+14h] [ebp-24h]
  void **v19; // [esp+20h] [ebp-18h] BYREF
  void *Block; // [esp+24h] [ebp-14h]
  int v21; // [esp+28h] [ebp-10h]
  char v22; // [esp+2Dh] [ebp-Bh]
  int j; // [esp+30h] [ebp-8h]
  int v24; // [esp+34h] [ebp-4h]

  v1 = sub_58D410(this);
  sub_42FCB0(0, 0);
  v2 = 50000;
  v19 = &DynamicVectorClass<Cell>::`vftable';
  j = 0;
  v24 = 50000;
  v3 = 0;
  if ( *(int *)(v1 + 16) > 0 )
  {
    v4 = v21;
    while ( 1 )
    {
      v5 = (_DWORD *)(*(_DWORD *)(v1 + 4) + 4 * v3);
      if ( j < v4 )
        goto LABEL_9;
      if ( (v22 != 0 || v4 == 0) && v2 > 0 )
        break;
LABEL_11:
      if ( ++v3 >= *(_DWORD *)(v1 + 16) )
        goto LABEL_12;
      v2 = v24;
    }
    if ( ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v19[2])(&v19, v2 + v4, 0) != 0 )
    {
LABEL_9:
      v6 = j++;
      *((_DWORD *)Block + v6) = *v5;
    }
    v4 = v21;
    goto LABEL_11;
  }
LABEL_12:
  if ( v1 != 0 )
    (**(void (__thiscall ***)(int, int))v1)(v1, 1);
  v7 = j;
  for ( i = j; j > 0; i = j )
  {
    v9 = i - 1;
    v10 = *((_DWORD *)Block + v9);
    if ( v9 < v7 )
    {
      for ( j = v7 - 1; v9 < j; *((_DWORD *)Block + v9 - 1) = *((_DWORD *)Block + v9) )
        ++v9;
    }
    for ( k = 0; k < 8; ++k )
    {
      v12 = k & 7;
      LOWORD(v17) = v10 + LOWORD(dword_89F688[v12]);
      HIWORD(v17) = HIWORD(v10) + HIWORD(dword_89F688[v12]);
      v13 = SHIWORD(v17) + (__int16)v17;
      if ( v13 > dword_ABED04
        && (__int16)v17 - SHIWORD(v17) < dword_ABED04
        && SHIWORD(v17) - (__int16)v17 < dword_ABED04
        && v13 <= dword_ABED08 )
      {
        v14 = (char *)dword_ABED10 + 80 * (__int16)v17 + 80 * dword_89C2DC * SHIWORD(v17);
        if ( *((_DWORD *)v14 + 14) == -1 && v14[75] != 0 )
        {
          *((_DWORD *)v14 + 14) = *(this + 2);
          if ( j < v21
            || (v22 != 0 || v21 == 0)
            && v24 > 0
            && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v19[2])(&v19, v24 + v21, 0) != 0 )
          {
            v15 = j++;
            *((_DWORD *)Block + v15) = v17;
          }
        }
      }
    }
    v7 = j;
  }
  v19 = &VectorClass<Cell>::`vftable';
  if ( Block != nullptr && v22 != 0 )
    operator delete(Block);
  return 1;
}
