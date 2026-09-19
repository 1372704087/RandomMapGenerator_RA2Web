// 0x654490 Radar_Bounds size=1B7

int __thiscall sub_654490(_DWORD *this, int a2)
{
  int v3; // edx
  int v4; // ecx
  __int16 v5; // di
  __int16 v6; // ax
  int v7; // ecx
  int result; // eax
  int v9; // edi
  int v10; // eax
  int v11; // ebp
  int v12; // eax
  int v13; // ecx
  int v14; // edx
  int v15; // edi
  int v16; // eax

  sub_567230(a2);
  v3 = *(this + 63);
  v4 = *(this + 64);
  *(this + 1322) = 0;
  *(this + 1320) = 10000;
  *(this + 1319) = 10000;
  v5 = v3 + v4 + 1;
  v6 = v4 + *(this + 61) - v3;
  v7 = *(this + 65);
  *(this + 1321) = 0;
  *(this + 1318) = -1;
  *(this + 1317) = (__int16)(v7 - 1 + v5) - (__int16)(1 - v7 + v6);
  *(this + 1316) = v6 - v5;
  sub_578350(&stru_87F7E8);
  result = sub_578290(this);
  v9 = result;
  if ( result != 0 )
  {
    while ( 1 )
    {
      a2 = *(_DWORD *)(v9 + 36);
      if ( (unsigned __int8)sub_578460(&a2, 1) != 0 )
        break;
LABEL_17:
      result = sub_578290(this);
      v9 = result;
      if ( result == 0 )
        return result;
    }
    if ( *(this + 1318) == -1 )
      *(this + 1318) = *(__int16 *)(v9 + 36) + *(__int16 *)(v9 + 38);
    v10 = *(this + 1316);
    v11 = *(this + 1318);
    a2 = *(_DWORD *)(v9 + 36);
    v12 = (__int16)a2 + v10 - SHIWORD(a2);
    v13 = (__int16)a2 + SHIWORD(a2) - v11;
    v14 = 2;
    if ( v12 == -1 )
    {
      v12 = 0;
    }
    else if ( v12 != 2 * *(this + 65) - 1 )
    {
LABEL_9:
      v15 = *(this + 1319);
      if ( v12 >= v15 )
      {
        if ( v14 + v12 > v15 + *(this + 1321) )
          *(this + 1321) = v12 + v14 - v15;
      }
      else
      {
        *(this + 1319) = v12;
      }
      v16 = *(this + 1320);
      if ( v13 >= v16 )
      {
        if ( v13 + 1 > *(this + 1322) + v16 )
          *(this + 1322) = v13 - v16 + 1;
      }
      else
      {
        *(this + 1320) = v13;
      }
      goto LABEL_17;
    }
    v14 = 1;
    goto LABEL_9;
  }
  return result;
}
