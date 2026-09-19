// 0x5a2f50 Hills_RandomWalk size=4A0

void __thiscall sub_5A2F50(int *this)
{
  double v1; // st7
  int v2; // ebx
  int v3; // edi
  int v4; // esi
  char *v5; // esi
  __int16 v6; // cx
  __int16 v7; // ax
  int v8; // ebp
  int v9; // edx
  double *v10; // eax
  int v11; // ecx
  int v12; // edi
  double *v13; // eax
  double v14; // st7
  double v15; // st7
  double v16; // st7
  bool v17; // zf
  double *v18; // esi
  double v20; // st7
  char v21; // c0
  double v22; // st7
  __int16 v23; // [esp+8h] [ebp-78h]
  double v24; // [esp+8h] [ebp-78h]
  double v25; // [esp+8h] [ebp-78h]
  int v26; // [esp+14h] [ebp-6Ch]
  int v27; // [esp+18h] [ebp-68h]
  int v28; // [esp+1Ch] [ebp-64h]
  int v29; // [esp+20h] [ebp-60h]
  double v30; // [esp+28h] [ebp-58h]
  double v31; // [esp+30h] [ebp-50h]
  double v32; // [esp+38h] [ebp-48h]
  double v33; // [esp+38h] [ebp-48h]
  double v34; // [esp+40h] [ebp-40h]
  double v35; // [esp+48h] [ebp-38h]
  double v36; // [esp+50h] [ebp-30h]
  double v37; // [esp+58h] [ebp-28h]
  double v38; // [esp+60h] [ebp-20h]
  double v39; // [esp+68h] [ebp-18h]
  double v40; // [esp+68h] [ebp-18h]
  double v41; // [esp+68h] [ebp-18h]
  double v42; // [esp+70h] [ebp-10h]
  double v43; // [esp+78h] [ebp-8h]

  v1 = (double)*(this + 17);
  v2 = dword_89C2DC * dword_89C2DC;
  v37 = v1 * 0.0001 + 0.1;
  v28 = dword_89C2DC * dword_89C2DC;
  v35 = v1 * 0.0025;
  v43 = v1 * 0.005;
  if ( v35 >= 0.025 )
  {
    v3 = 0;
    if ( v2 > 0 )
    {
      v4 = 0;
      v27 = dword_89C2DC * dword_89C2DC;
      v26 = 0;
      do
      {
        v5 = (char *)dword_ABED10 + v4;
        v29 = *(_DWORD *)v5;
        if ( *(_DWORD *)v5 != 0 )
        {
          v6 = *(_DWORD *)v5 - 1;
          v23 = HIWORD(v29) - 1;
          *((_DWORD *)v5 + 4) = 0;
          v7 = HIWORD(v29) - 1;
          *((_DWORD *)v5 + 5) = 0;
          v8 = (__int16)(HIWORD(v29) - 1) + v6;
          v34 = 0.0;
          v30 = 0.0;
          if ( v8 > dword_ABED04 && v6 - v7 < dword_ABED04 && v7 - v6 < dword_ABED04 && v8 <= dword_ABED08 )
            v34 = *((double *)dword_ABED10 + 10 * v6 + 10 * dword_89C2DC * v23 + 1);
          v9 = SHIWORD(v29) + v6;
          if ( v9 <= dword_ABED04
            || v6 - SHIWORD(v29) >= dword_ABED04
            || SHIWORD(v29) - v6 >= dword_ABED04
            || v9 > dword_ABED08 )
          {
            *((_DWORD *)v5 + 2) = *((_DWORD *)v5 + 2);
            v11 = *((_DWORD *)v5 + 3);
            *((_DWORD *)v5 + 4) = LODWORD(v35);
            *((_DWORD *)v5 + 3) = v11;
            *((_DWORD *)v5 + 5) = HIDWORD(v35);
          }
          else
          {
            v10 = (double *)((char *)dword_ABED10 + 80 * v6 + 80 * dword_89C2DC * SHIWORD(v29));
            *((double *)v5 + 1) = *((double *)v5 + 1) + v10[1];
            *((_DWORD *)v5 + 4) = *((_DWORD *)v10 + 4);
            *((_DWORD *)v5 + 5) = *((_DWORD *)v10 + 5);
            v30 = v10[1] - v34;
          }
          v12 = v23 + (__int16)v29;
          if ( v12 <= dword_ABED04
            || (__int16)v29 - v23 >= dword_ABED04
            || v23 - (__int16)v29 >= dword_ABED04
            || v12 > dword_ABED08 )
          {
            v14 = v35 + *((double *)v5 + 2);
            *((_DWORD *)v5 + 2) = *((_DWORD *)v5 + 2);
            *((_DWORD *)v5 + 3) = *((_DWORD *)v5 + 3);
            *((double *)v5 + 2) = v14;
          }
          else
          {
            v13 = (double *)((char *)dword_ABED10 + 80 * (__int16)v29 + 80 * dword_89C2DC * v23);
            *((double *)v5 + 1) = v13[1] + *((double *)v5 + 1);
            *((double *)v5 + 2) = v13[2] + *((double *)v5 + 2);
            v30 = v13[1] - v34 + v30;
          }
          v15 = *((double *)v5 + 1) * 0.5;
          *((double *)v5 + 1) = v15;
          *((double *)v5 + 2) = *((double *)v5 + 2) * 0.5;
          if ( v30 <= 0.0 )
          {
            if ( v30 < 0.0 )
              v30 = -v37;
          }
          else
          {
            v30 = v37;
          }
          if ( v5[69] != 0 )
          {
            if ( v15 <= 0.0 )
              v15 = 0.0;
            *((double *)v5 + 1) = v15;
            *((_DWORD *)v5 + 4) = 1202590843;
            *((_DWORD *)v5 + 5) = 1063549665;
          }
          v32 = -*((double *)v5 + 2);
          v38 = 0.0;
          v36 = 0.025;
          v24 = v43 - *((double *)v5 + 2);
          if ( -0.025 > v24 || v32 > 0.025 )
          {
            v36 = (v24 - v32) * 0.5;
            v38 = v36 - *((double *)v5 + 2);
          }
          do
          {
            do
              v39 = sub_5980C0((double *)&byte_ABDFB8) * v36 + v38;
            while ( v39 < v32 );
          }
          while ( v39 > v24 );
          v40 = v39 + *((double *)v5 + 2);
          *((double *)v5 + 2) = v40;
          v25 = -2.0 - *((double *)v5 + 1);
          v33 = 2.0 - *((double *)v5 + 1);
          if ( v30 >= v25 )
          {
            if ( v30 <= v33 )
              v16 = v30;
            else
              v16 = v33;
          }
          else
          {
            v16 = v25;
          }
          v42 = v16;
          v31 = v40;
          if ( v16 - v40 > v33 || v40 + v16 < v25 )
          {
            v31 = (v33 - v25) * 0.5;
            v42 = v31 + v25;
          }
          do
          {
            do
              v41 = sub_5980C0((double *)&byte_ABDFB8) * v31 + v42;
            while ( v41 < v25 );
          }
          while ( v41 > v33 );
          v2 = v28;
          v3 = 0;
          *((double *)v5 + 1) = v41 + *((double *)v5 + 1);
        }
        v4 = v26 + 80;
        v17 = v27 == 1;
        v26 += 80;
        --v27;
      }
      while ( !v17 );
      if ( v2 > 0 )
      {
        while ( 1 )
        {
          v18 = (double *)((char *)dword_ABED10 + v3 + 8);
          v20 = *v18;
          if ( v21 != 0 )
            break;
          if ( v20 > 0.0 )
          {
            v22 = (double)sub_7C5F00(*v18 + 0.5);
            goto LABEL_52;
          }
LABEL_53:
          v3 += 80;
          if ( --v2 == 0 )
            return;
        }
        v22 = (double)sub_7C5F00(v20 - 0.5);
LABEL_52:
        *v18 = v22;
        goto LABEL_53;
      }
    }
  }
}
