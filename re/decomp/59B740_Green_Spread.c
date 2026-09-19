// 0x59b740 Green_Spread size=1F9

void sub_59B740()
{
  int *i; // ebp
  int j; // edi
  _DWORD *v2; // esi
  int v3; // eax
  int v4; // edx
  unsigned int v5; // esi
  int v6; // eax
  _DWORD *v7; // ecx
  int v8; // ebp
  int v9; // edi
  _DWORD *v10; // esi
  int v11; // eax
  int k; // [esp+10h] [ebp-34h]
  __int64 v13; // [esp+1Ch] [ebp-28h]
  double v14; // [esp+24h] [ebp-20h]
  void **v15; // [esp+2Ch] [ebp-18h] BYREF
  void *Block; // [esp+30h] [ebp-14h]
  int v17; // [esp+34h] [ebp-10h]
  char v18; // [esp+39h] [ebp-Bh]
  int v19; // [esp+3Ch] [ebp-8h]
  int v20; // [esp+40h] [ebp-4h]

  sub_5AD820(0, 0);
  v15 = &DynamicVectorClass<CellClass *>::`vftable';
  v19 = 0;
  v20 = 10000;
  sub_578350(&stru_87F7E8);
  for ( i = (int *)sub_578290(&stru_87F7E8); i != nullptr; i = (int *)sub_578290(&stru_87F7E8) )
  {
    if ( sub_4867B0(i) )
    {
      for ( j = 0; j < 8; j += 2 )
      {
        v2 = (_DWORD *)sub_481810(j);
        if ( sub_486380(v2)
          && (v19 < v17
           || (v18 != 0 || v17 == 0)
           && v20 > 0
           && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v15[2])(&v15, v20 + v17, 0) != 0) )
        {
          v3 = v19++;
          *((_DWORD *)Block + v3) = v2;
        }
      }
    }
  }
  v4 = v19 / 3;
  if ( v19 / 3 > 1000 )
    v4 = 1000;
  if ( v4 > 0 )
  {
    for ( k = v4; k != 0; --k )
    {
      v5 = v19 - 1;
      v14 = (double)(unsigned int)v19;
      do
      {
        v13 = (unsigned int)sub_65C780(&unk_ABE890);
        v6 = sub_7C5F00((double)v13 * v14 * 2.328306437080797e-10);
      }
      while ( v6 > v5 );
      v7 = Block;
      v8 = *((_DWORD *)Block + v6);
      if ( v6 < v19 && v6 < --v19 )
      {
        while ( 1 )
        {
          v7[v6] = v7[v6 + 1];
          if ( ++v6 >= v19 )
            break;
          v7 = Block;
        }
      }
      v9 = 0;
      *(_DWORD *)(v8 + 56) = dword_AA0E18;
      do
      {
        v10 = (_DWORD *)sub_481810(v9);
        if ( sub_486380(v10)
          && (v19 < v17
           || (v18 != 0 || v17 == 0)
           && v20 > 0
           && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v15[2])(&v15, v20 + v17, 0) != 0) )
        {
          v11 = v19++;
          *((_DWORD *)Block + v11) = v10;
        }
        v9 += 2;
      }
      while ( v9 < 8 );
    }
  }
  v15 = &VectorClass<CellClass *>::`vftable';
  if ( Block != nullptr && v18 != 0 )
    operator delete(Block);
}
